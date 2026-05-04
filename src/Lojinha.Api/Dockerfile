FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Lojinha.sln ./
COPY src/Lojinha.Api/Lojinha.Api.csproj src/Lojinha.Api/
COPY src/Lojinha.Domain/Lojinha.Domain.csproj src/Lojinha.Domain/
COPY src/Lojinha.Application/Lojinha.Application.csproj src/Lojinha.Application/
COPY src/Lojinha.Infrastructure/Lojinha.Infrastructure.csproj src/Lojinha.Infrastructure/
COPY tests/Lojinha.Api.Tests/Lojinha.Api.Tests.csproj tests/Lojinha.Api.Tests/

RUN dotnet restore src/Lojinha.Api/Lojinha.Api.csproj

COPY . .
RUN dotnet publish src/Lojinha.Api/Lojinha.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
RUN find /etc/apt -name "*.list" -o -name "*.sources" | xargs sed -i 's|http://archive.ubuntu.com|https://archive.ubuntu.com|g; s|http://security.ubuntu.com|https://security.ubuntu.com|g' \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends curl libgssapi-krb5-2 \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
COPY src/Lojinha.Api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]