"""
Notification service for risk alerts
"""

import asyncio
import json
import logging
from datetime import datetime
from decimal import Decimal
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional, Set

import aiosmtplib
from fastapi import WebSocket
from pymongo.database import Database

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending notifications."""

    def __init__(
        self,
        db: Database,
        smtp_host: str = "smtp.gmail.com",
        smtp_port: int = 587,
        smtp_user: Optional[str] = None,
        smtp_password: Optional[str] = None,
        notification_cooldown: int = 1800,  # 30 minutes
    ):
        """Initialize notification service."""
        self.db = db
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.notification_cooldown = notification_cooldown

        self._websocket_connections: Dict[str, Set[WebSocket]] = {}
        self._last_notification: Dict[str, datetime] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Start notification service."""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._process_notifications())
        logger.info("Notification service started")

    async def stop(self):
        """Stop notification service."""
        if not self._running:
            return

        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        # Close all websocket connections
        for connections in self._websocket_connections.values():
            for ws in connections:
                await ws.close()

        logger.info("Notification service stopped")

    async def register_websocket(self, user_id: str, websocket: WebSocket):
        """Register websocket connection for user."""
        if user_id not in self._websocket_connections:
            self._websocket_connections[user_id] = set()
        self._websocket_connections[user_id].add(websocket)
        logger.info(f"Registered websocket for user {user_id}")

    async def unregister_websocket(self, user_id: str, websocket: WebSocket):
        """Unregister websocket connection."""
        if user_id in self._websocket_connections:
            self._websocket_connections[user_id].discard(websocket)
            if not self._websocket_connections[user_id]:
                del self._websocket_connections[user_id]
        logger.info(f"Unregistered websocket for user {user_id}")

    async def send_notification(
        self, user_id: str, notification_type: str, data: Dict[str, Any]
    ):
        """Send notification to user."""
        current_time = datetime.utcnow()

        # Check notification cooldown
        last_time = self._last_notification.get(user_id)
        if (
            last_time
            and (current_time - last_time).total_seconds() < self.notification_cooldown
        ):
            return

        # Get user notification preferences
        user = await self.db.users.find_one({"_id": user_id})
        if not user or not user.get("notification_settings"):
            return

        notification_settings = user["notification_settings"]

        # Create notification document
        notification = {
            "user_id": user_id,
            "type": notification_type,
            "data": data,
            "timestamp": current_time,
            "status": "pending",
        }

        # Save to database
        result = await self.db.notifications.insert_one(notification)
        notification["_id"] = result.inserted_id

        # Send via different channels based on settings
        try:
            # WebSocket notifications
            if notification_settings.get("websocket", True):
                await self._send_websocket_notification(user_id, notification)

            # Email notifications
            if notification_settings.get("email", True):
                await self._send_email_notification(
                    user["email"], notification_type, data
                )

            # Update notification status
            await self.db.notifications.update_one(
                {"_id": notification["_id"]}, {"$set": {"status": "sent"}}
            )

            # Update last notification time
            self._last_notification[user_id] = current_time

        except Exception as e:
            logger.error(f"Error sending notification: {e}")
            await self.db.notifications.update_one(
                {"_id": notification["_id"]},
                {"$set": {"status": "failed", "error": str(e)}},
            )

    async def _send_websocket_notification(
        self, user_id: str, notification: Dict[str, Any]
    ):
        """Send notification via websocket."""
        if user_id not in self._websocket_connections:
            return

        message = json.dumps({"type": "notification", "data": notification})

        dead_connections = set()

        for ws in self._websocket_connections[user_id]:
            try:
                await ws.send_text(message)
            except Exception as e:
                logger.error(f"Error sending websocket message: {e}")
                dead_connections.add(ws)

        # Clean up dead connections
        for ws in dead_connections:
            await self.unregister_websocket(user_id, ws)

    async def _send_email_notification(
        self, email: str, notification_type: str, data: Dict[str, Any]
    ):
        """Send notification via email."""
        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP credentials not configured")
            return

        # Create email message
        message = MIMEMultipart()
        message["From"] = self.smtp_user
        message["To"] = email
        message["Subject"] = f"Risk Alert: {notification_type}"

        # Create HTML content
        html = self._create_email_content(notification_type, data)
        message.attach(MIMEText(html, "html"))

        # Send email
        try:
            async with aiosmtplib.SMTP(
                hostname=self.smtp_host, port=self.smtp_port, use_tls=True
            ) as smtp:
                await smtp.login(self.smtp_user, self.smtp_password)
                await smtp.send_message(message)
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            raise

    def _create_email_content(
        self, notification_type: str, data: Dict[str, Any]
    ) -> str:
        """Create HTML content for email notification."""
        if notification_type == "risk_alert":
            return self._create_risk_alert_email(data)
        elif notification_type == "position_update":
            return self._create_position_update_email(data)
        else:
            return self._create_generic_email(notification_type, data)

    def _create_risk_alert_email(self, data: Dict[str, Any]) -> str:
        """Create HTML content for risk alert email."""
        alerts = data.get("alerts", [])

        html = """
        <html>
            <body>
                <h2>Risk Alert</h2>
                <p>The following risk thresholds have been exceeded:</p>
                <ul>
        """

        for alert in alerts:
            html += f"""
                <li>
                    <strong>{alert['type'].title()}:</strong>
                    Current value: {alert['value']:.2%}
                    (Threshold: {alert['threshold']:.2%})
                </li>
            """

        html += """
                </ul>
                <p>Please review your positions and take necessary action.</p>
            </body>
        </html>
        """

        return html

    def _create_position_update_email(self, data: Dict[str, Any]) -> str:
        """Create HTML content for position update email."""
        html = """
        <html>
            <body>
                <h2>Position Update</h2>
                <table border="1">
                    <tr>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Amount</th>
                        <th>Current Price</th>
                        <th>PnL</th>
                    </tr>
        """

        for position in data.get("positions", []):
            html += f"""
                <tr>
                    <td>{position['symbol']}</td>
                    <td>{position['side']}</td>
                    <td>{position['amount']}</td>
                    <td>{position['current_price']}</td>
                    <td>{position.get('unrealized_pnl', 0):.2%}</td>
                </tr>
            """

        html += """
                </table>
            </body>
        </html>
        """

        return html

    def _create_generic_email(
        self, notification_type: str, data: Dict[str, Any]
    ) -> str:
        """Create HTML content for generic notification email."""
        html = f"""
        <html>
            <body>
                <h2>{notification_type.title()}</h2>
                <pre>{json.dumps(data, indent=2)}</pre>
            </body>
        </html>
        """

        return html

    async def _process_notifications(self):
        """Process pending notifications."""
        while self._running:
            try:
                # Find failed notifications to retry
                notifications = await self.db.notifications.find(
                    {"status": "failed", "retry_count": {"$lt": 3}}
                ).to_list(None)

                for notification in notifications:
                    try:
                        await self.send_notification(
                            notification["user_id"],
                            notification["type"],
                            notification["data"],
                        )
                    except Exception as e:
                        logger.error(f"Error retrying notification: {e}")
                        await self.db.notifications.update_one(
                            {"_id": notification["_id"]},
                            {
                                "$inc": {"retry_count": 1},
                                "$set": {"last_error": str(e)},
                            },
                        )

                await asyncio.sleep(60)  # Check every minute

            except Exception as e:
                logger.error(f"Error in notification processing loop: {e}")
                await asyncio.sleep(5)  # Short delay before retry
