#!/usr/bin/env bash

#######################################
# (c) Copyright IBM Corp. 2021
# (c) Copyright Instana Inc. and contributors 2021
#######################################

set -eo pipefail

cd `dirname $BASH_SOURCE`/..
source ../../bin/add-to-package-lock
addToPackageLock package-lock.json @instana/serverless false
addToPackageLock package-lock.json @instana/core false
