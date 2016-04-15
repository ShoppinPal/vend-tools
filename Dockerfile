# you can get details about the following image from https://hub.docker.com/_/node/
FROM node:0.10.36

MAINTAINER Pulkit Singhal (pulkitsinghal@gmail.com)

RUN apt-get -y update
RUN apt-get install -y tree

# already installed in node:${version} images
#RUN apt-get install git-all

# for debugging ports
RUN apt-get install -y telnet

# https://github.com/jfrazelle/dockerfiles/issues/12
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get install -y less

RUN mkdir -p /apps
WORKDIR /apps

RUN npm install -g vend-tools
