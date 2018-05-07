/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

/* eslint-disable no-param-reassign */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Subscription} from 'rxjs';
import type {SshTunnelService} from '../../nuclide-ssh-tunnel/lib/types';

import invariant from 'assert';
import {SimpleCache} from 'nuclide-commons/SimpleCache';
import nullthrows from 'nullthrows';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable, Subject} from 'rxjs';
import consumeFirstProvider from 'nuclide-commons-atom/consumeFirstProvider';
import {getAdbServiceByNuclideUri} from 'nuclide-adb/lib/utils';

export function startTunnelingAdb(
  uri: NuclideUri,
  retries?: number = 0,
): Observable<'ready'> {
  if (!nuclideUri.isRemote(uri)) {
    return Observable.of('ready').concat(Observable.never());
  }
  const {tunnels} = activeTunnels.getOrCreate(uri, (_, serviceUri) => {
    invariant(typeof serviceUri === 'string');
    const adbService = getAdbServiceByNuclideUri(serviceUri);
    const observable = Observable.defer(() => adbService.killServer())
      .switchMap(() => openTunnels(serviceUri))
      .retryWhen(errors => {
        return errors.do(error => {
          // $FlowIgnore - ignore retries reassignment
          if (retries-- <= 0) {
            throw error;
          }
        });
      })
      .catch(e => {
        stopTunnelingAdb(uri);
        throw e;
      })
      .publishReplay(1);
    const subscription = observable.connect();
    return {
      tunnels: observable,
      subscription,
    };
  });
  changes.next();

  return tunnels;
}

export function stopTunnelingAdb(uri: NuclideUri) {
  activeTunnels.delete(uri);
  changes.next();
}

export function isAdbTunneled(uri: NuclideUri): Observable<boolean> {
  return changes
    .startWith(undefined)
    .map(() => activeTunnels.get(uri) != null)
    .distinctUntilChanged();
}

const activeTunnels: SimpleCache<
  NuclideUri,
  {tunnels: Observable<'ready'>, subscription: Subscription},
> = new SimpleCache({
  keyFactory: uri =>
    nuclideUri.createRemoteUri(nuclideUri.getHostname(uri), '/'),
  dispose: value => value.subscription.unsubscribe(),
});
const changes: Subject<void> = new Subject();

function openTunnels(host: NuclideUri): Observable<'ready'> {
  const tunnels = [
    {
      description: 'adb',
      from: {host, port: 5037, family: 4},
      to: {host: 'localhost', port: 5037, family: 4},
    },
    {
      description: 'emulator console',
      from: {host, port: 5554, family: 4},
      to: {host: 'localhost', port: 5554, family: 4},
    },
    {
      description: 'emulator adb',
      from: {host, port: 5555, family: 4},
      to: {host: 'localhost', port: 5555, family: 4},
    },
    {
      description: 'exopackage',
      from: {host, port: 2829, family: 4},
      to: {host: 'localhost', port: 2829, family: 4},
    },
  ];

  return Observable.defer(() =>
    nullthrows(consumeFirstProvider('nuclide.ssh-tunnel')),
  ).switchMap((service: SshTunnelService) => service.openTunnels(tunnels));
}
