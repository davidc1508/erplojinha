#!/bin/sh
set -eu

if [ -f /run/secrets/jwt_key ]; then
  export Jwt__Key="$(tr -d '\r\n' < /run/secrets/jwt_key)"
fi

exec dotnet Lojinha.Api.dll