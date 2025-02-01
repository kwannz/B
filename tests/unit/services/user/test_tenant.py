"""Test tenant models."""

import time
from datetime import datetime

from tradingbot.models.tenant import Tenant, TenantStatus


def test_tenant_init():
    """Test tenant initialization."""
    name = "Test Tenant"
    api_key = "test-api-key"
    tenant = Tenant(name=name, api_key=api_key)

    assert tenant.name == name
    assert tenant.api_key == api_key
    assert tenant.status == TenantStatus.ACTIVE
    assert isinstance(tenant.settings, dict)
    assert len(tenant.settings) == 0
    assert isinstance(tenant.created_at, datetime)
    assert isinstance(tenant.updated_at, datetime)
    assert tenant.created_at == tenant.updated_at
    assert tenant.id is None


def test_tenant_init_with_settings():
    """Test tenant initialization with settings."""
    settings = {"key": "value"}
    tenant = Tenant(name="Test", api_key="test", settings=settings)
    assert tenant.settings == settings


def test_tenant_is_active():
    """Test tenant is_active property."""
    tenant = Tenant(name="Test", api_key="test")
    assert tenant.is_active is True

    tenant.status = TenantStatus.INACTIVE
    assert tenant.is_active is False

    tenant.status = TenantStatus.SUSPENDED
    assert tenant.is_active is False

    tenant.status = TenantStatus.DELETED
    assert tenant.is_active is False


def test_tenant_update_settings():
    """Test tenant settings update."""
    tenant = Tenant(name="Test", api_key="test")
    original_updated_at = tenant.updated_at

    # Wait a moment to ensure timestamp difference
    time.sleep(0.001)

    new_settings = {"key": "value"}
    tenant.update_settings(new_settings)

    assert tenant.settings == new_settings
    assert tenant.updated_at > original_updated_at


def test_tenant_deactivate():
    """Test tenant deactivation."""
    tenant = Tenant(name="Test", api_key="test")
    original_updated_at = tenant.updated_at

    time.sleep(0.001)
    tenant.deactivate()

    assert tenant.status == TenantStatus.INACTIVE
    assert tenant.updated_at > original_updated_at
    assert tenant.is_active is False


def test_tenant_reactivate():
    """Test tenant reactivation."""
    tenant = Tenant(name="Test", api_key="test", status=TenantStatus.INACTIVE)
    original_updated_at = tenant.updated_at

    time.sleep(0.001)
    tenant.reactivate()

    assert tenant.status == TenantStatus.ACTIVE
    assert tenant.updated_at > original_updated_at
    assert tenant.is_active is True


def test_tenant_suspend():
    """Test tenant suspension."""
    tenant = Tenant(name="Test", api_key="test")
    original_updated_at = tenant.updated_at

    time.sleep(0.001)
    tenant.suspend()

    assert tenant.status == TenantStatus.SUSPENDED
    assert tenant.updated_at > original_updated_at
    assert tenant.is_active is False


def test_tenant_delete():
    """Test tenant deletion."""
    tenant = Tenant(name="Test", api_key="test")
    original_updated_at = tenant.updated_at

    time.sleep(0.001)
    tenant.delete()

    assert tenant.status == TenantStatus.DELETED
    assert tenant.updated_at > original_updated_at
    assert tenant.is_active is False


def test_tenant_status_enum():
    """Test TenantStatus enum values."""
    assert TenantStatus.ACTIVE == "active"
    assert TenantStatus.INACTIVE == "inactive"
    assert TenantStatus.SUSPENDED == "suspended"
    assert TenantStatus.DELETED == "deleted"

    # Test that all status values are strings
    for status in TenantStatus:
        assert isinstance(status, str)
