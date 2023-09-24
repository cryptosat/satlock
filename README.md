# Guardian Key Recovery Snap

This repository offers a MetaMask Snap dedicated to the Guardian Key Recovery process. Developed by CryptoSat for the ETHGlobal NYC Hackathon, it's a demo of what could be possible with a real life satellite integrated system.

## Local Deployment
### Front End - This Repository
Clone the repository and setup the development environment:

```shell
cd satlock
yarn install && yarn start
```

####  Testing and Linting

Run `yarn test` to run the tests once.

Run `yarn lint` to run the linter, or run `yarn lint:fix` to run the linter and fix any automatically fixable issues.

### Backend 
See the backend [repository](https://github.com/cryptosat/satlock_api)

# Usage 
## Guardian Key Recovery Guide

Follow these steps to recover your account using Guardian Keys:

1. **Ask for Guardian Keys**  
   Ask your friends for their Guardian Keys. They can get their public Guardian keys by clicking the `Show Your Guardian Key` button!

2. **Back Up Account**  
   Click `Back Up Account` To initiate the flow!

3. **Lost Your Key?**  
   If you've lost your key, give your friends your address and ask them to `Approve recovery`.

4. **Restore Account**  
   After enough guardians have approved, click `Restore Account`. Then, import the recovered account into Metamask!

