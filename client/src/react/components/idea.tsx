import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TrashIcon } from './trash-icon';
import styles from './idea.module.css';

export type Idea = {
	id: string;
	text: string;
	creator: string;
};

export const Idea = ({ id, text, creator }: Idea) => {
	const queryClient = useQueryClient();
	const deleteIdea = useMutation({
		mutationFn: async ({ ideaId }: { ideaId: Idea['id'] }) => {
			const api = new URL('/api/idea', import.meta.env.PUBLIC_API_URL);

			const data = new URLSearchParams();
			data.append('ideaId', ideaId);

			const res = await fetch(api, {
				method: 'DELETE',
				body: data,
				credentials: 'include',
			}).catch((err) => {
				console.log({ err });
				throw new Error(err);
			});

			if (!res.ok) {
				throw new Error(res.statusText);
			}

			const result = await res.json();

			return result;
		},
		onSuccess: async (deletedIdea: Idea) => {
			await queryClient.cancelQueries({ queryKey: ['/api/ideas'] });

			queryClient.setQueryData(['/api/ideas'], (old: Idea[]): Idea[] =>
				old.filter((idea) => idea.id !== deletedIdea.id),
			);
		},
		onError: async (error): Promise<void> => {
			console.log(error);
			alert('Error: only admins can delete ideas');
		},
	});

	return (
		<li className={styles.idea}>
			<span className={styles.title}>{text}</span>
			<span className={styles.creator}>{creator}</span>
			<span className={styles.controls}>
				<form
					method="DELETE"
					action="/api/idea"
					onSubmit={(e) => {
						e.preventDefault();

						const data = new FormData(e.currentTarget);
						const ideaId = data.get('ideaId') as string;

						if (!ideaId) {
							return;
						}

						deleteIdea.mutate({ ideaId });
					}}
				>
					<input type="hidden" name="ideaId" value={id} />
					<button type="submit" className={styles.delete}>
						<span className="screen-reader-only">delete idea</span>
						<TrashIcon />
					</button>
				</form>
			</span>
		</li>
	);
};
