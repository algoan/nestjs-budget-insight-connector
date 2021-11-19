import { AggregationDetails } from '../../algoan/dto/customer.objects';

/**
 * Join userId to the existing userId from the customer.aggregationDetails
 * @param newUserId the id of the user to add to the customer
 * @param aggregationDetails the aggregation details of the customer
 * @returns the new aggregation details to patch in the customer
 */
export const joinUserId = (
  newUserId?: string | number,
  aggregationDetails?: AggregationDetails,
): AggregationDetails => {
  const userId: string = `${newUserId}`;

  // Add if no user id
  if (aggregationDetails?.userId === undefined) {
    return { userId };
  }

  // Add if user id does not already exist in the customer
  return aggregationDetails.userId.split(',').includes(userId)
    ? {}
    : { userId: `${aggregationDetails.userId},${userId}` };
};
