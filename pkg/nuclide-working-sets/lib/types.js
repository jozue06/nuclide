/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

export type {WorkingSetsStore} from './WorkingSetsStore';

export type WorkingSetDefinition = {
  name: string,
  active: boolean,
  uris: Array<string>,
  originURLs?: Array<string>,
  isActiveProject?: boolean, // Does this working set represent the currently active atom project?
};
