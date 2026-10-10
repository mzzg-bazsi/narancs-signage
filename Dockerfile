# Narancs Signage szerver – Docker kép (amd64 és arm64). Nincs külső függőség, csak Node.js.
#   docker run -d -p 8080:8080 -v narancs-signage:/data --name narancs-signage ghcr.io/mzzg-bazsi/narancs-signage
FROM node:24-alpine
# időzóna adatok a helyi idő szerinti riportokhoz (TZ=Europe/Budapest)
RUN apk add --no-cache tzdata
WORKDIR /app
COPY LICENSE ./
COPY install/install-player.sh ./install/
COPY server/package.json ./server/
COPY server/src ./server/src
COPY server/public ./server/public
# az adatok (adatbázis + média) a /data kötetben maradnak meg frissítéskor is
RUN mkdir /data && chown node:node /data
ENV PORT=8080 SIGNAGE_DATA=/data
VOLUME /data
EXPOSE 8080
USER node
WORKDIR /app/server
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/api/auth/state >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
