FROM node:14-alpine AS confluence-cloud
LABEL maintainer Ascensio System SIA <support@onlyoffice.com>
ARG AC_OPTS
ENV AC_OPTS=$AC_OPTS
WORKDIR /usr/src/app
COPY ./package*.json ./
RUN echo "AC_OPTS=$AC_OPTS" >> /usr/src/app/.env && \
    npm install && \
    npm install pg --save
COPY . .
EXPOSE 3000
CMD [ "npm", "start" ]
