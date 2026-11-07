// @flow
// Icons used in the editor for element types, presets and website items.
import * as React from 'react';
import SvgIcon from '@material-ui/core/SvgIcon';
import ViewAgenda from '@material-ui/icons/ViewAgenda';
import ViewColumn from '@material-ui/icons/ViewColumn';
import ViewModule from '@material-ui/icons/ViewModule';
import Title from '@material-ui/icons/Title';
import TextFields from '@material-ui/icons/TextFields';
import LinkIcon from '@material-ui/icons/Link';
import ImageIcon from '@material-ui/icons/Image';
import Movie from '@material-ui/icons/Movie';
import FormatListBulleted from '@material-ui/icons/FormatListBulleted';
import Remove from '@material-ui/icons/Remove';
import SpaceBar from '@material-ui/icons/SpaceBar';
import Star from '@material-ui/icons/Star';
import Input from '@material-ui/icons/Input';
import ShortText from '@material-ui/icons/ShortText';
import Subject from '@material-ui/icons/Subject';
import ArrowDropDownCircle from '@material-ui/icons/ArrowDropDownCircle';
import CheckBox from '@material-ui/icons/CheckBox';
import Label from '@material-ui/icons/Label';
import Widgets from '@material-ui/icons/Widgets';
import Code from '@material-ui/icons/Code';
import WebAsset from '@material-ui/icons/WebAsset';
import CallToAction from '@material-ui/icons/CallToAction';
import Web from '@material-ui/icons/Web';
import Menu from '@material-ui/icons/Menu';
import Tab from '@material-ui/icons/Tab';
import ViewCarousel from '@material-ui/icons/ViewCarousel';
import OpenInNew from '@material-ui/icons/OpenInNew';
import CropSquare from '@material-ui/icons/CropSquare';
import TouchApp from '@material-ui/icons/TouchApp';
import ViewDay from '@material-ui/icons/ViewDay';
import Description from '@material-ui/icons/Description';
import Palette from '@material-ui/icons/Palette';
import FlashOn from '@material-ui/icons/FlashOn';
import Extension from '@material-ui/icons/Extension';
import InsertDriveFile from '@material-ui/icons/InsertDriveFile';
import Public from '@material-ui/icons/Public';
import Settings from '@material-ui/icons/Settings';
import Storage from '@material-ui/icons/Storage';
import Functions from '@material-ui/icons/Functions';

export const ReactIcon = (props: any) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <g fill="none" stroke="currentColor" strokeWidth="1.3">
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </g>
    <circle cx="12" cy="12" r="1.9" fill="currentColor" />
  </SvgIcon>
);

export const WebvelopLogoIcon = (props: any) => (
  <SvgIcon {...props} viewBox="0 0 64 64">
    <defs>
      <linearGradient id="wvLogoGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#6366f1" />
        <stop offset="1" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#wvLogoGradient)" />
    <path
      d="M14 20 L22 46 L32 26 L42 46 L50 20"
      fill="none"
      stroke="#ffffff"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SvgIcon>
);

const icons = {
  page: Description,
  section: ViewDay,
  container: CropSquare,
  row: ViewColumn,
  grid: ViewModule,
  header: Web,
  navigation: Menu,
  footer: CallToAction,
  heading: Title,
  text: TextFields,
  button: TouchApp,
  link: LinkIcon,
  list: FormatListBulleted,
  divider: Remove,
  spacer: SpaceBar,
  icon: Star,
  image: ImageIcon,
  video: Movie,
  form: ViewAgenda,
  label: Label,
  input: Input,
  textarea: Subject,
  select: ArrowDropDownCircle,
  checkbox: CheckBox,
  component: Widgets,
  react: ReactIcon,
  embed: Code,
  tabs: Tab,
  carousel: ViewCarousel,
  modal: OpenInNew,
  shortText: ShortText,
  webAsset: WebAsset,
  palette: Palette,
  interactions: FlashOn,
  extension: Extension,
  file: InsertDriveFile,
  site: Public,
  settings: Settings,
  variables: Storage,
  customAction: Functions,
  script: Code,
};

export const getIconComponent = (name: string): any => icons[name] || CropSquare;

export const ElementIcon = ({ name, ...props }: { name: string }) => {
  const Icon = getIconComponent(name);
  return <Icon fontSize="inherit" {...props} />;
};
