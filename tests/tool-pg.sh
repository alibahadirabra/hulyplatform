#!/usr/bin/env bash

export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
export MINIO_ENDPOINT=localhost:9002
export ACCOUNTS_URL=http://localhost:3003
export TRANSACTOR_URL=ws://localhost:3334
export MONGO_URL=mongodb://localhost:27018
export ELASTIC_URL=http://localhost:9201
export SERVER_SECRET=secret
export DB_URL=postgresql://postgres:example@localhost:5432

node ../dev/tool/bundle/bundle.js $@