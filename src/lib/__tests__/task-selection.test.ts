import { describe, expect, it } from '@jest/globals';
import { getUpgradeForNetwork, groupUpgradesByTask } from '../task-selection';
import { NetworkType, TaskStatus, Upgrade } from '../types';

function upgrade({
  id,
  network,
  ...overrides
}: Partial<Upgrade> & Pick<Upgrade, 'id' | 'network'>): Upgrade {
  return {
    id,
    name: `${network} name`,
    description: `${network} description`,
    date: '2025-06-04',
    network,
    status: TaskStatus.ReadyToSign,
    ...overrides,
  };
}

describe('task selection helpers', () => {
  it('groups upgrades by task id and sorts the available networks', () => {
    const options = groupUpgradesByTask([
      upgrade({ id: '2025-06-04-upgrade-foo', network: NetworkType.Zeronet }),
      upgrade({ id: '2025-06-04-upgrade-foo', network: NetworkType.Mainnet }),
      upgrade({ id: '2025-07-12-upgrade-bar', network: NetworkType.Sepolia }),
    ]);

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({
      id: '2025-06-04-upgrade-foo',
      networks: [NetworkType.Mainnet, NetworkType.Zeronet],
    });
    expect(options[1]).toMatchObject({
      id: '2025-07-12-upgrade-bar',
      networks: [NetworkType.Sepolia],
    });
  });

  it('keeps network-specific metadata for the selected network', () => {
    const mainnetUpgrade = upgrade({
      id: '2025-06-04-upgrade-foo',
      network: NetworkType.Mainnet,
      name: 'Mainnet title',
      description: 'Mainnet README content',
      status: TaskStatus.ReadyToSign,
    });
    const zeronetUpgrade = upgrade({
      id: '2025-06-04-upgrade-foo',
      network: NetworkType.Zeronet,
      name: 'Zeronet title',
      description: 'Zeronet README content',
      status: TaskStatus.Executed,
      executionLinks: [{ label: 'Execution', url: 'https://example.com/tx' }],
    });

    const [taskOption] = groupUpgradesByTask([mainnetUpgrade, zeronetUpgrade]);

    expect(taskOption.displayUpgrade).toBe(mainnetUpgrade);
    expect(getUpgradeForNetwork(taskOption, NetworkType.Mainnet)).toBe(mainnetUpgrade);
    expect(getUpgradeForNetwork(taskOption, NetworkType.Zeronet)).toBe(zeronetUpgrade);
    expect(getUpgradeForNetwork(taskOption, NetworkType.Zeronet)).toMatchObject({
      name: 'Zeronet title',
      description: 'Zeronet README content',
      status: TaskStatus.Executed,
    });
  });
});
