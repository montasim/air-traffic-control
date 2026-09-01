import PauseCircleIcon from '@hugeicons/core-free-icons/PauseCircleIcon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';
import ReloadIcon from '@hugeicons/core-free-icons/ReloadIcon';
import MapsSquare01Icon from '@hugeicons/core-free-icons/MapsSquare01Icon';
import VolumeHighIcon from '@hugeicons/core-free-icons/VolumeHighIcon';
import VolumeMute02Icon from '@hugeicons/core-free-icons/VolumeMute02Icon';

type IconAttributes = Readonly<Record<string, string | number>>;
type HugeIconData = readonly (readonly [string, IconAttributes])[];

export const APP_ICONS = {
  pause: PauseCircleIcon,
  play: PlayIcon,
  restart: ReloadIcon,
  map: MapsSquare01Icon,
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
