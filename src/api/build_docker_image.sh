#!bin/bash
docker build -t recycling_calendar_api .
docker volume create recycling_notifier_api_volume