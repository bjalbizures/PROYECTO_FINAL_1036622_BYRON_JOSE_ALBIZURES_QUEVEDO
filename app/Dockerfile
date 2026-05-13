FROM php:8.2-apache

RUN sed -i 's/Listen 80/Listen 5509/' /etc/apache2/ports.conf

RUN apt-get update && apt-get install -y \
    libzip-dev \
    unzip \
    default-mysql-client \
    && docker-php-ext-install mysqli pdo pdo_mysql \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

EXPOSE 5509
