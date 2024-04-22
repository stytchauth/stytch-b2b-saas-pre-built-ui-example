import avatar from '../../images/avatar.jpg';
import styles from './avatar.module.css';

export const Avatar = () => {
	return (
		<a href="/dashboard/account" className={styles.avatar}>
			<img {...avatar} alt="Jane Developer's avatar" width="60" height="60" />
		</a>
	);
};
