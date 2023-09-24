import { Json, JsonRpcRequest, OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text } from '@metamask/snaps-ui';

const CRYPTOSAT_API_HOST = 'https://localhost:9000';

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
      return handleGetEthParentNode(origin);
    case 'approveRecovery':
      return handleApproveRecovery(origin);
    default:
      throw new Error('Method not found.');
  }
};

/**
 * Handles a getEthParentNode request to snap.
 *
 * @param origin - Calling host.
 */
async function handleGetEthParentNode(origin: string) {
  const ethParentNode = await snap.request({
    method: 'snap_getBip44Entropy',
    params: { coinType: 1 }, // Bitcoin network
  });

  const approved = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        text(`Hi Potential Key-Loser, **${origin}**!`),
        text(
          `Would you like to backup your account ${ethParentNode.publicKey} with Cryptosat?`,
        ),
      ]),
    },
  });

  if (approved) {
    const storekeyparams = {
      enc_backup_key: JSON.stringify(ethParentNode),
      address: ethParentNode.publicKey,
      approved_guardians: ['testGuard1', 'testGuard2'],
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

      return approved;
    } catch (error) {
      const errMsg = `Failed getting Cryptosat response: ${error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
  } else {
    console.log('Backup request denied');
  }

  return approved;
}

/**
 * Handle recovery approval.
 *
 * @param origin - Caller origin.
 */
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

  const approved = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        text(`Hi Guardian, **${origin}**!`),
        text(
          `Would you like approve key-recovery for your friend ${lostAddress}?`,
        ),
      ]),
    },
  });

  if (!approved) {
    console.log('Recovery rejected');
  }

  return approved;
}
