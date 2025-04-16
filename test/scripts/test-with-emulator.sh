#!/bin/bash

# Ensure we start from the project root
PROJECT_ROOT=$(pwd)

# Load environment variables from .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo "Loading environment variables from .env file"
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
else
  echo "ERROR: No .env file found. Please create one based on .env.local.example"
  echo "Copy .env.local.example to .env and modify as needed"
  exit 1
fi

# Display the configuration being used
echo "Using configuration:"
echo "FIREBASE_PROJECT_ID: $FIREBASE_PROJECT_ID"
echo "FIRESTORE_EMULATOR_HOST: $FIRESTORE_EMULATOR_HOST"
echo "FIRESTORE_EMULATOR_PORT: $FIRESTORE_EMULATOR_PORT"

# Check if Firebase emulator is already running
HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1}"
PORT="${FIRESTORE_EMULATOR_PORT:-8089}"
nc -z $HOST $PORT
EMULATOR_RUNNING=$?

EMULATOR_PID=""
if [[ $EMULATOR_RUNNING -eq 0 ]]; then
  echo "Firebase emulator is already running on $HOST:$PORT. Using existing instance."
else
  # Start Firebase emulator in the background
  echo "Starting new Firebase emulator instance..."
  cd "$PROJECT_ROOT/test/emulator" && firebase emulators:start -P ${FIREBASE_PROJECT_ID} &
  EMULATOR_PID=$!

  # Wait for Firebase emulator to be fully initialized
  counter=0
  max_attempts=30

  echo "Waiting for Firebase emulator to be ready..."

  while [[ $counter -lt $max_attempts ]]; do
    nc -z $HOST $PORT
    result=$?
    if [[ $result -eq 0 ]]; then
      echo "Firebase emulator on $HOST:$PORT is up!"
      break
    fi
    echo "Waiting for Firebase emulator on $HOST:$PORT... Attempt $((counter+1))/$max_attempts"
    sleep 1
    ((counter++))
  done

  if [[ $counter -eq $max_attempts ]]; then
    echo "Firebase emulator on $HOST:$PORT did not start within $max_attempts attempts."
    kill $EMULATOR_PID
    exit 1
  fi
fi

# Run the tests with environment variables
cd "$PROJECT_ROOT" && vitest

# Cleanup - only kill if we started the emulator
if [[ -n "$EMULATOR_PID" ]]; then
  echo "Shutting down emulator instance we started (PID: $EMULATOR_PID)"
  kill $EMULATOR_PID
fi