#!/bin/bash

# Usage
# ./install-elastic-plugin.sh sanity_elastic_1

# Direct download, or use VPN.
#wget https://artifacts.elastic.co/downloads/elasticsearch-plugins/ingest-attachment/ingest-attachment-7.14.2.zip
docker cp ./ingest-attachment-7.14.2.zip $1:/ingest-attachment-7.14.2.zip
docker exec -ti $1 ./bin/elasticsearch-plugin install file:///ingest-attachment-7.14.2.zip
docker restart $1