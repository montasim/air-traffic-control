import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Target01Icon from '@hugeicons/core-free-icons/Target01Icon';
import AirportTowerIcon from '@hugeicons/core-free-icons/AirportTowerIcon';
import Medal01Icon from '@hugeicons/core-free-icons/Medal01Icon';
import Globe02Icon from '@hugeicons/core-free-icons/Globe02Icon';
import Shield01Icon from '@hugeicons/core-free-icons/Shield01Icon';
import Airplane02Icon from '@hugeicons/core-free-icons/Airplane02Icon';
import AirplaneLanding01Icon from '@hugeicons/core-free-icons/AirplaneLanding01Icon';
import LockKeyIcon from '@hugeicons/core-free-icons/LockKeyIcon';
import PauseIcon from '@hugeicons/core-free-icons/PauseIcon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';
import ReloadIcon from '@hugeicons/core-free-icons/ReloadIcon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon';
import HelpCircleIcon from '@hugeicons/core-free-icons/HelpCircleIcon';
import Award01Icon from '@hugeicons/core-free-icons/Award01Icon';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import VolumeHighIcon from '@hugeicons/core-free-icons/VolumeHighIcon';
import VolumeMute02Icon from '@hugeicons/core-free-icons/VolumeMute02Icon';

type IconAttributes = Readonly<Record<string, string | number>>;
type HugeIconData = readonly (readonly [string, IconAttributes])[];

export const APP_ICONS = {
  close: Cancel01Icon,
  landing: AirplaneLanding01Icon,
  fleet: Airplane02Icon,
  safety: Shield01Icon,
  explore: Globe02Icon,
  veteran: Medal01Icon,
  pressure: AirportTowerIcon,
  target: Target01Icon,

  pause: PauseIcon,
  play: PlayIcon,
  restart: ReloadIcon,
  home: Home01Icon,
  lock: LockKeyIcon,
  settings: Settings01Icon,
  help: HelpCircleIcon,
  career: Award01Icon,
  back: ArrowLeft01Icon,
  expand: ArrowDown01Icon,
  volume: VolumeHighIcon,
  mute: VolumeMute02Icon
} satisfies Record<string, HugeIconData>;

export type AppIconName = keyof typeof APP_ICONS;

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function svgAttributeName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function mountHugeIcon(
  target: HTMLElement,
  name: AppIconName,
  size = 22
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('hugeicon');

  for (const [tagName, attributes] of APP_ICONS[name]) {
    const node = document.createElementNS(SVG_NAMESPACE, tagName);
    for (const [attributeName, value] of Object.entries(attributes)) {
      if (attributeName === 'key') continue;
      node.setAttribute(svgAttributeName(attributeName), String(value));
    }
    svg.append(node);
  }

  target.replaceChildren(svg);
  target.dataset.icon = name;
  return svg;
}
