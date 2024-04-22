import type { ReactNode } from 'react';

export const Header = ({
	heading,
	children,
}: {
	heading: string;
	children?: ReactNode;
}) => {
	return (
		<header>
			<h1>{heading}</h1>
			{children}
		</header>
	);
};
