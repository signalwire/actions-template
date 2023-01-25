#!/bin/bash
# ls -la
# printenv

cat > /root/.rpmmacros <<EOF
%_signature gpg
%_gpg_name $INPUT_GPG_NAME
EOF

gpg --import $GPG_KEY_FILE


cd $INPUT_RPM_PATH
echo stuff in incoming
find .

# Sign rpm files
for i in `ls -1 *rpm`; do echo $i; rpm --resign $i; done

mkdir -p $INPUT_TARGET_PATH/$INPUT_TARGET_FOLDER
cp *.rpm $INPUT_TARGET_PATH/$INPUT_TARGET_FOLDER.

# Generate repo metadata
cd $INPUT_TARGET_PATH
createrepo $INPUT_TARGET_FOLDER

# Sign metadata once createrepo generates it
cd $INPUT_TARGET_FOLDER
# You MUST remove repomd.xml.asc, otherwise gpg fails.
rm -f repodata/repomd.xml.asc
# You MUST use --batch, otherwise gpg will rise `gpg: cannot open '/dev/tty': No such device or address`
gpg --batch --detach-sign --armor repodata/repomd.xml
