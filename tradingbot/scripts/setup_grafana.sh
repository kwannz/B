#!/bin/bash
set -e

# Create Grafana directories
mkdir -p /var/lib/grafana/dashboards
mkdir -p /etc/grafana/provisioning/dashboards
mkdir -p /etc/grafana/provisioning/datasources

# Set permissions
chown -R grafana:grafana /var/lib/grafana/dashboards
chown -R grafana:grafana /etc/grafana/provisioning

# Copy dashboard files
cp /app/docker/grafana/dashboards/*.json /var/lib/grafana/dashboards/
cp /app/docker/grafana/provisioning/dashboards/*.yml /etc/grafana/provisioning/dashboards/
cp /app/docker/grafana/provisioning/datasources/*.yml /etc/grafana/provisioning/datasources/

# Set correct permissions on copied files
chown -R grafana:grafana /var/lib/grafana/dashboards/*.json
chown -R grafana:grafana /etc/grafana/provisioning/dashboards/*.yml
chown -R grafana:grafana /etc/grafana/provisioning/datasources/*.yml
