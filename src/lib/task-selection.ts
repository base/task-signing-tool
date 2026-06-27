import { NetworkType, Upgrade } from './types';

export type TaskOption = {
  id: string;
  displayUpgrade: Upgrade;
  networks: NetworkType[];
  upgradesByNetwork: Partial<Record<NetworkType, Upgrade>>;
};

export function groupUpgradesByTask(upgrades: Upgrade[]): TaskOption[] {
  const grouped = new Map<string, TaskOption>();

  for (const upgrade of upgrades) {
    const network = upgrade.network as NetworkType;
    const existing = grouped.get(upgrade.id);

    if (existing) {
      if (!existing.networks.includes(network)) {
        existing.networks.push(network);
      }
      existing.upgradesByNetwork[network] = upgrade;
      continue;
    }

    grouped.set(upgrade.id, {
      id: upgrade.id,
      displayUpgrade: upgrade,
      networks: [network],
      upgradesByNetwork: {
        [network]: upgrade,
      },
    });
  }

  return Array.from(grouped.values()).map(option => ({
    ...option,
    networks: [...option.networks].sort((a, b) => a.localeCompare(b)),
  }));
}

export function getUpgradeForNetwork(
  taskOption: TaskOption,
  network: NetworkType
): Upgrade | undefined {
  return taskOption.upgradesByNetwork[network];
}
