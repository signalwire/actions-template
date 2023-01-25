#!/bin/bash
# ls -la
printenv

cat > /root/.rpmmacros <<EOF
%_signature gpg
%_gpg_name $INPUT_GPG_NAME
EOF

ls -l /root
cat /root/.rpmmacros 
