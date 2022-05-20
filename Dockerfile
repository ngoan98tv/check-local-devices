FROM node:16

RUN apt update \
    && apt install -y net-tools
