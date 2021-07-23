# SSMParameters

Lightweight AWS Parameter Store wrapper written in Typescript, designed for
easy-to-use in mind, and built-in cache.

## Installation

```bash
npm install --save ssm-parameters
```

## Usage

```js
import { SSMParameters } from 'ssm-parameters';

// Create a SSMParameters with all parameters to load
const params = new SSMParameters({
  LogLevel: '/LogLevel',
  AppId: '/ApiId',
  ClientId: '/ClientId',
});

// Get parameter (it will load the parameters from the SSM if there's no cache)
const logLevel = await params.get('LogLevel');

// Get parameter (it will use the cache if it's still fresh)
const appId = await params.get('AppId');

// Get parameter (it can be forced to ignore the cache)
const clientId = await params.get('ClientId', { ignoreCache: true });

// Manually load the parameters (it will use the cache if it's still fresh)
await params.load();

// Manually load the parameters (it can be forced to ignore the cache)
await params.load({ ignoreCache: true });

// Get all parameters (it will load the parameters from the SSM if there's no cache)
const parameters = await params.getAll();
const param1 = parameters['LogLevel'];
const param2 = parameters['AppId'];

// Get all parameters (it can be forced to ignore the cache)
const newParameters = await params.getAll({ ignoreCache: true });
```

### Options

```js
import { SSMParameters } from 'ssm-parameters';

// Create a SSMParameters passing options
const params = new SSMParameters(
  { LogLevel: '/LogLevel' },
  { withDecryption: true, maxAge: 7200 },
);
```

The available options are:

- **withDecryption:** Return decrypted secure string value (default: `true`)
- **maxAge:** Maximum number of seconds the parameters will be considered fresh (default: `3600`)
- **ssmConfiguration:** https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SSM.html (optional)

### Usage with AWS Lambda

```js
import { SSMParameters } from 'ssm-parameters';

const params = new SSMParameters({ Name: '/Name' });
params.load();

exports.handler = async function (event, context) {
  const name = await params.get('Name');
  return `Hello ${name}`;
};
```

## IAM (SSM Parameter)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameters"],
      "Resource": "arn:aws:ssm:<REGION>:<ACCOUNT_ID>:parameter/<PARAMETER_NAME>"
    }
  ]
}
```

## Licenses

This project is released under [MIT License](./LICENSE).
