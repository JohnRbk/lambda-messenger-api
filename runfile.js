const { run } = require('runjs');
const fs = require('fs');
const config = require('./config/config.json');

function isConfigured() {

  const requiredFiles = ['./config/config.json', './config/firebase-config.js'];

  let valid = true;

  /* eslint-disable-next-line no-restricted-syntax */
  for (const f of requiredFiles) {
    if (!fs.existsSync(f)) {
      console.log(`Missing required file "${f}". See README.md for instructions on how to generate this file`);
      valid = false;
    }
  }

  return valid;
}

function clean() {
  run('rm -f lambda-messenger-template.yaml');
  run('rm -f *.zip');
}

function zip() {
  run('npm prune --production');

  /* eslint-disable-next-line no-useless-escape */
  const ts = new Date().toISOString().replace(/[:\.]/g, '-');
  const zipfile = `lambda-package-${ts}.zip`;
  console.log(`Zipping file ${zipfile} ...`);
  run(`zip -q -r ${zipfile} node_modules/* src/index.js src/api.js config/config.json config/firebase-config.js config/serviceAccountKey.json`);
  return zipfile;
}

function s3Bucket() {
  run(`aws s3 mb s3://${config.LAMBDA_PACKAGE_S3_BUCKET}`);
}

function upload(zipfile) {
  run(`aws s3 cp ${zipfile} s3://${config.LAMBDA_PACKAGE_S3_BUCKET}`);
}

function deploy(zipfile) {
  run(
    `aws cloudformation deploy \
    --template-file lambda-messenger-template.yaml \
    --stack-name ${config.CLOUDFORMATION_LAMBDA_STACK_NAME} \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
      BucketName=${config.LAMBDA_PACKAGE_S3_BUCKET} \
      LambdaRole=${config.LAMBDA_IAM_ROLE} \
      ZipFile=${zipfile}`,
  );
}

function getAppsyncSchema() {
  run(
    `aws appsync get-introspection-schema \
    --api-id ${config.APPSYNC_API_ID} --format JSON  schema.json`,
  );
}

function generateClientStubs() {
  getAppsyncSchema();
  run(
    'npx aws-appsync-codegen generate config/posts.graphql --schema schema.json --output API.swift --target swift',
  );
}

function sam() {
  run(
    `aws cloudformation package \
    --force-upload \
    --template-file config/sam.yaml \
    --s3-bucket ${config.LAMBDA_PACKAGE_S3_BUCKET} \
    --output-template-file lambda-messenger-template.yaml`,
  );
}

function test(testFiles = 'tests/*Tests.js') {
  if (isConfigured() === false) {
    return;
  }
  run(`mocha ${testFiles} --timeout=10000`);
}

function coverage(testFiles = 'tests/*Tests.js') {
  run(`npx nyc mocha ${testFiles} --timeout=10000`);
}

function all() {
  if (isConfigured() === false) {
    return;
  }
  clean();
  s3Bucket();
  const zipfile = zip();
  upload(zipfile);
  sam();
  deploy(zipfile);

  console.log('*********************************************************');
  console.log('* After deployig this package, please run \'npm install\' *');
  console.log('* (This is because the node_modules directory gets      *');
  console.log('* pruned to remove all dev dependencies prior to        *');
  console.log('* packaging a zip file)                                 *');
  console.log('*********************************************************');
}

module.exports = {
  all,
  clean,
  s3Bucket,
  zip,
  upload,
  sam,
  deploy,
  test,
  coverage,
  generateClientStubs,

};
