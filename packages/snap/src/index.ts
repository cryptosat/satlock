/* eslint-disable jsdoc/require-jsdoc */
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
      return handleBackupAccount(origin);
    case 'approveRecovery':
      return handleApproveRecovery(origin);
    case 'showGuardianKey':
      return showGuardianKey(origin);
    default:
      throw new Error('Method not found.');
  }
};

async function getPublicKey() {
  const entropy = await snap.request({
    method: 'snap_getBip44Entropy',
    params: { coinType: 1 },
  });
  return entropy.publicKey;
}

/**
 * Handles a getEthParentNode request to snap.
 *
 * @param origin - Calling host.
 */
async function handleBackupAccount(origin: string) {
  const entropy = await snap.request({
    method: 'snap_getBip44Entropy',
    params: { coinType: 1 },
  });

  const approved = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        text(`Hi Potential Key-Loser, **${origin}**!`),
        text(`Would you like to backup your account with Cryptosat?`),
        text(`${entropy.publicKey}`),
      ]),
    },
  });

  if (!approved) {
    console.log('Backup request denied');
    return false;
  }
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
    enc_backup_key: JSON.stringify(entropy),
    address: entropy.publicKey,
    approved_guardians: [guardians],
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

async function callGuardianApprove(
  oldLoserAddress: string,
  guardianPublicKey: string,
  newLoserAddress: string,
) {
  // const concatData = oldLoserAddress + guardianPublicKey + newLoserAddress;
  const hash = 'fakehash';

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

async function handleApproveRecovery(origin: string) {
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
        text(`Hi Guardian, **${origin}**!`),
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

async function showGuardianKey(origin: string) {
  const pubKey = await getPublicKey();

  const guardianKey = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([text(`${pubKey}`)]),
    },
  });

  if (!guardianKey) {
    console.log('Recovery cancelled');
    return false;
  }
  return true;
}
