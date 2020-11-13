import BaseComponent from './base';

export interface TabProps {
	role: string;
	icon?: string;
	name: string;
	$root: Element;
	onClick: () => void;
	index: number;
	tabIndex: number;
	onHover?: () => void;
	onHoverOut?: () => void;
	url: string;
	materialIcon?: string;
	onDestroy?: () => void;
}

export default class Tab extends BaseComponent {
	props: TabProps;
	$el: Element;
	constructor(props: TabProps) {
		super();
		this.props = props;
	}

	registerListeners(): void {
		this.$el.addEventListener('click', this.props.onClick);
		this.$el.addEventListener('mouseover', this.props.onHover);
		this.$el.addEventListener('mouseout', this.props.onHoverOut);
	}

	// X showNetworkError(): void {
	// X	this.webview.forceLoad();
	// X }

	activate(): void {
		this.$el.classList.add('active');
	}

	deactivate(): void {
		this.$el.classList.remove('active');
	}

	destroy(): void {
		this.$el.remove();
	}
}
