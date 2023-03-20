FROM node:19-alpine

RUN npm install -g pm2

WORKDIR /curvemon

COPY package.json .

RUN npm install

COPY . .

EXPOSE 2053

CMD ["pm2-runtime", "CurveMonitor.mjs"]