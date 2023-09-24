/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable jsdoc/require-jsdoc */
import { secp256k1 } from 'ethereum-cryptography/secp256k1';
import { sha256 } from 'ethereum-cryptography/sha256';
import { keccak256 } from 'ethereum-cryptography/keccak';
import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text } from '@metamask/snaps-ui';

const CRYPTOSAT_API_HOST = 'http://localhost:9000';

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  switch (request.method) {
    case 'getEthParentNode':
      return handleBackupAccount();
    case 'approveRecovery':
      return handleApproveRecovery();
    case 'showGuardianKey':
      return showGuardianKey();
    default:
      throw new Error('Method not found.');
    case 'restoreAccount':
      return restoreAccount();
  }
};

async function getPublicKey() {
  const entropy = await snap.request({
    method: 'snap_getBip44Entropy',
    params: { coinType: 1 },
  });
  return entropy.publicKey;
}

function derivePublicKey(privateKeyHex: string) {
  // Convert the hex string to a Buffer
  const privateKeyBuffer: Buffer = Buffer.from(privateKeyHex, 'hex');

  // Derive the public key
  const publicKeyBuffer: Buffer = Buffer.from(
    secp256k1.getPublicKey(privateKeyBuffer, false).slice(1).buffer,
  ); // Remove the first byte (0x04) to get the 64-byte public key

  return publicKeyBuffer;
}

function deriveEthereumAddress(publicKey: Buffer): string {
  // Hash the public key
  const pubKeyHash = keccak256(publicKey); // remove the first byte if it's 0x04

  // Take the last 20 bytes of this hash
  const addrBuffer: Buffer = Buffer.from(pubKeyHash.slice(-20).buffer);

  // Convert to hex, and make it lowercase because Ethereum addresses are not case-sensitive
  const address = addrBuffer.toString('hex').toLowerCase();

  return `0x${address}`;
}

/**
 * Handles a getEthParentNode request to snap.
 *
 * @param origin - Calling host.
 */
async function handleBackupAccount() {
  const privateKey = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'prompt',
      content: panel([
        text(`Hi Potential Key-Loser!`),
        text('Enter the private key you want to backup with Cryptosat'),
      ]),
    },
  });

  if (!privateKey) {
    console.log('Backup request denied');
    return false;
  }

  console.log('Private key:', privateKey);
  const publicKey = derivePublicKey(privateKey);
  const ethAddress: string = deriveEthereumAddress(publicKey);
  console.log('Public key: ', ethAddress);

  const guardians: string[] = [];
  for (let i = 0; i < 2; i++) {
    guardians[i] = await snap.request({
      method: 'snap_dialog',
      params: {
        type: 'prompt',
        content: panel([text(`Provide the public key of guardian ${i + 1}`)]),
        placeholder: '0x123...',
      },
    });

    if (!guardians[i]) {
      console.log('Backup aborted');
      return false;
    }
  }

  const storekeyparams = {
    enc_backup_key: privateKey,
    address: ethAddress,
    approved_guardians: guardians,
  };

  console.log('Backup request approved');
  try {
    const apiResponse = await fetch(`${CRYPTOSAT_API_HOST}/storebackupkey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(storekeyparams),
    });

    if (!apiResponse.ok) {
      const errMsg = `Failed calling Cryptosat API: ${apiResponse.statusText}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
  } catch (error) {
    const errMsg = `Failed getting Cryptosat response: ${error}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }

  return true;
}

function computeHashBase64(msg: string) {
  const hash: Uint8Array = sha256(new Uint8Array(Buffer.from(msg).buffer));
  return Buffer.from(hash).toString('base64');
}

async function callGuardianApprove(
  oldLoserAddress: string,
  guardianPublicKey: string,
  newLoserAddress: string,
) {
  const msg = oldLoserAddress + guardianPublicKey + newLoserAddress;
  const hash = computeHashBase64(msg);
  console.log(`Data hash: ${hash}`);

  // Package the parameters into a data object
  const dataToSend = {
    old_loser_address: oldLoserAddress,
    guardian_public_key: guardianPublicKey,
    new_loser_address: newLoserAddress,
    signature: hash, // later on this should be a signature over the hash
  };

  try {
    const response = await fetch(`${CRYPTOSAT_API_HOST}/guardianapprove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataToSend),
    });

    if (response.ok) {
      const jsonResponse = await response.json();
      console.log('API response:', jsonResponse);
    } else {
      console.error(
        `Failed to fetch: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error occurred while making the API call:', error);
  }
}

async function handleApproveRecovery() {
  const lostAddress = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'prompt',
      content: panel([
        text('What is the wallet address?'),
        text('Enter the wallet address to recover'),
      ]),
      placeholder: '0x123...',
    },
  });

  if (!lostAddress) {
    console.log('Recovery cancelled');
    return false;
  }

  const lostAddressStr = lostAddress.toString();

  const approved = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        text(`Hi Guardian!`),
        text(
          `Would you like approve key-recovery for wallet ${lostAddressStr}?`,
        ),
      ]),
    },
  });

  if (!approved) {
    console.log('Recovery rejected');
    return false;
  }
  const pubkey = await getPublicKey();
  await callGuardianApprove(lostAddressStr, pubkey, 'newAddress');
  return approved;
}

async function showGuardianKey() {
  const pubKey = await getPublicKey();

  await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'alert',
      content: panel([text(`${pubKey}`)]),
    },
  });

  return true;
}

async function restoreAccount() {
  const newPubKey = await getPublicKey();

  await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        text('No worries! Your friendly Satellite is here!'),
        text('Ask your guardians to release start the recovery process.'),
        text(
          'Ask them to input the old address and the following public key, when prompted:',
        ),
        text(`${newPubKey}`),
        text(
          `When the required amount of Guardians have finished authorizing the recovery, click Approve.`,
        ),
      ]),
    },
  });

  const addressOfLostKey = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'prompt',
      content: panel([text('Enter the address of the key to recover')]),
    },
  });
  const dataToSend = {
    old_loser_address: addressOfLostKey,
  };

  try {
    const response = await fetch(`${CRYPTOSAT_API_HOST}/recoverkey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataToSend),
    });

    if (response.ok) {
      const jsonResponse = await response.json();
      await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([text(`${jsonResponse.encrypted_key}`)]),
        },
      });
      console.log('API response:', jsonResponse);
    } else {
      console.error(
        `Failed to fetch: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error occurred while making the API call:', error);
  }

  return true;
}
