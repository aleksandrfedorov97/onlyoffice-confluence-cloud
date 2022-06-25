FROM node:14-alpine AS confluence-cloud
LABEL maintainer Ascensio System SIA <support@onlyoffice.com>
ENV NODE_ENV=production \
    AC_OPTS=no_reg \
    PORT=3000
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN npm install && \
    npm install pg --save
COPY . .
EXPOSE $PORT
CMD [ "npm", "start" ]
