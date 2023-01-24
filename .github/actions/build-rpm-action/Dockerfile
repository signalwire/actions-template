FROM --platform=linux/amd64 centos:7.2.1511

RUN mkdir /data
WORKDIR /data

RUN yum install -y wget dos2unix wget epel-release

RUN yum install -y zlib-devel cmake gcc-c++ libcurl-devel krb5-dxevel multilib-rpm-config openssl-devel make rpm-build rpmdevtools libtool autoconf automake gzip lksctp-tools-devel glib2-devel bind-license sqlite \
  cyrus-sasl-lib dbus dbus-libs dracut expat glib2 glib2-devel gnupg2 libxml2 procps-ng python python-libs vim-minimal xz xz-libs yum-plugin-fastestmirror

COPY run.sh run.sh
RUN chmod 755 run.sh
RUN dos2unix run.sh
CMD ["sh", "run.sh"]