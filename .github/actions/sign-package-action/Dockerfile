FROM --platform=linux/amd64 centos:7.2.1511

RUN mkdir /data
WORKDIR /data

RUN yum install -y rpm-build rpmdevtools rpm-sign createrepo
COPY rpmmacros /root/.rpmmacros
RUN cat /root/.rpmmacros
COPY script.sh script.sh
RUN chmod +x script.sh
CMD ["sh", "script.sh"]

