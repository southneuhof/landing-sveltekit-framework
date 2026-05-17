import type { ReorderEntriesOptions } from '../types/index.js';
export type { ReorderEntriesOptions } from '../types/index.js';

export async function reorderEntries(options: ReorderEntriesOptions) {
  if (typeof options.model !== 'string' || options.model.trim() === '') {
    throw new TypeError('Model must be a non-empty string');
  }

  if (options.id === undefined || options.id === null || options.id === '') {
    throw new TypeError('Reorder payload "id" is required');
  }

  if (typeof options.from !== 'number' || !Number.isFinite(options.from)) {
    throw new TypeError('Reorder payload "from" must be a number');
  }

  if (typeof options.to !== 'number' || !Number.isFinite(options.to)) {
    throw new TypeError('Reorder payload "to" must be a number');
  }

  if (
    !Array.isArray(options.axis) ||
    options.axis.length === 0 ||
    options.axis.some((field) => typeof field !== 'string')
  ) {
    throw new TypeError('Reorder axis must be configured');
  }

  const orderField = options.orderField ?? 'order';
  const from = Math.floor(options.from);
  const to = Math.floor(options.to);
  const id = options.id;
  const model = options.model;
  const delegate = options.prisma[model];

  if (from < 1) throw new Error('Reorder "from" must be greater than or equal to 1');
  if (to < 1) throw new Error('Reorder "to" must be greater than or equal to 1');

  if (!delegate) {
    throw new Error(`Model "${model}" not found`);
  }

  const currentItem = await delegate.findUnique({ where: { id } });
  if (!currentItem) {
    throw new Error('Record not found');
  }

  const axisWhere = options.axis.length === 1 && options.axis[0] === '*'
    ? {}
    : Object.fromEntries(
        options.axis.map((field) => {
          if (!(field in currentItem)) throw new Error(`Axis field "${field}" not found on record`);
          return [field, currentItem[field]];
        }),
      );

  if (from === to) {
    return { message: 'No changes in order' };
  }

  await options.prisma.$transaction(async (tx: any) => {
    const txDelegate = tx[model];

    if (from < to) {
      await txDelegate.updateMany({
        where: {
          ...axisWhere,
          [orderField]: {
            gt: from,
            lte: to,
          },
        },
        data: {
          [orderField]: {
            decrement: 1,
          },
        },
      });
    } else {
      await txDelegate.updateMany({
        where: {
          ...axisWhere,
          [orderField]: {
            gte: to,
            lt: from,
          },
        },
        data: {
          [orderField]: {
            increment: 1,
          },
        },
      });
    }

    await txDelegate.update({
      where: { id },
      data: { [orderField]: to },
    });
  });

  return { message: 'Order updated successfully' };
}
