import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text } from '@metamask/snaps-ui';

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
    default:
      throw new Error('Method not found.');
  }
};

async function handleGetEthParentNode(origin: string) {
  const ethParentNode = await snap.request({
    method: 'snap_getBip44Entropy',
    params: { coinType: 1 },
  });

  const approved = snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        text(`Hello, **${origin}**!`),
        text(
          `Would you like to share your entropy with Cryptosat?... ${ethParentNode.privateKey}`
        ),
      ]),
    },
  });

  return approved;
}
