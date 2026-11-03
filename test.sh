#!/bin/bash
# Runs the end-to-end API test. Server must be running.
node "$(dirname "$0")/test.js"
