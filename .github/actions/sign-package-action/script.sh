#!/bin/bash

cat > /root/.rpmmacros <<EOF
%_signature gpg
%_gpg_name $INPUT_GPG_NAME
EOF


cp *.rpm .
cat /root/.rpmmacros 
ls -l
pwd
gpg --import $INPUT_GPG_FILE


echo stuff in incoming
find .

# Sign rpm files
for i in `ls -1 *rpm`; do echo $i; rpm --resign $i; done