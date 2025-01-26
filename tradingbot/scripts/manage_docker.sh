 #!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [command]"
    echo "Commands:"
    echo "  start       - Start all services"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  status      - Show status of all services"
    echo "  logs        - Show logs of all services"
    echo "  clean       - Remove all containers and volumes"
    echo "  rebuild     - Rebuild and restart services"
    echo "  verify      - Run verification checks"
    echo "  update      - Update Docker images"
    echo "  backup      - Backup MongoDB data"
    echo "  restore     - Restore MongoDB data"
    exit 1
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}Docker is not running${NC}"
        exit 1
    fi
}

# Function to start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"
    docker-compose up -d
    echo -e "${GREEN}Services started${NC}"
}

# Function to stop services
stop_services() {
    echo -e "${YELLOW}Stopping services...${NC}"
    docker-compose down
    echo -e "${GREEN}Services stopped${NC}"
}

# Function to show service status
show_status() {
    echo -e "${YELLOW}Service Status:${NC}"
    docker-compose ps
}

# Function to show logs
show_logs() {
    if [ -z "$1" ]; then
        docker-compose logs --tail=100 -f
    else
        docker-compose logs --tail=100 -f "$1"
    fi
}

# Function to clean up
clean_up() {
    echo -e "${YELLOW}Stopping all services...${NC}"
    docker-compose down -v
    echo -e "${YELLOW}Removing all containers...${NC}"
    docker-compose rm -f
    echo -e "${YELLOW}Cleaning up volumes...${NC}"
    docker volume prune -f
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Function to rebuild services
rebuild_services() {
    echo -e "${YELLOW}Rebuilding services...${NC}"
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    echo -e "${GREEN}Services rebuilt and started${NC}"
}

# Function to update Docker images
update_images() {
    echo -e "${YELLOW}Updating Docker images...${NC}"
    docker-compose pull
    docker-compose up -d
    echo -e "${GREEN}Images updated${NC}"
}

# Function to backup MongoDB data
backup_mongodb() {
    echo -e "${YELLOW}Backing up MongoDB data...${NC}"
    BACKUP_DIR="backups/mongodb"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).gz"
    
    docker-compose exec -T mongodb mongodump --archive --gzip > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Backup completed: $BACKUP_FILE${NC}"
    else
        echo -e "${RED}Backup failed${NC}"
        exit 1
    fi
}

# Function to restore MongoDB data
restore_mongodb() {
    if [ -z "$1" ]; then
        echo -e "${RED}Please specify backup file to restore${NC}"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$1" ]; then
        echo -e "${RED}Backup file not found: $1${NC}"
        exit 1
    }
    
    echo -e "${YELLOW}Restoring MongoDB data from $1...${NC}"
    docker-compose exec -T mongodb mongorestore --archive --gzip < "$1"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Restore completed${NC}"
    else
        echo -e "${RED}Restore failed${NC}"
        exit 1
    fi
}

# Check if Docker is running
check_docker

# Parse command
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        start_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2"
        ;;
    clean)
        clean_up
        ;;
    rebuild)
        rebuild_services
        ;;
    verify)
        ./scripts/verify_docker.sh
        ;;
    update)
        update_images
        ;;
    backup)
        backup_mongodb
        ;;
    restore)
        restore_mongodb "$2"
        ;;
    *)
        usage
        ;;
esac
