import { Container, loadBalance, getContainer } from '@cloudflare/containers';

export class MyContainer extends Container {
	defaultPort = 8080; // The default port for the container to listen on
	sleepAfter = '3m'; // Sleep the container if no requests are made in this timeframe

	envVars = {
		MESSAGE: 'I was passed in via the container class!',
	};

	override onStart() {
		console.log('Container successfully started');
	}

	override onStop() {
		console.log('Container successfully shut down');
	}

	override onError(error: unknown) {
		console.log('Container error:', error);
	}
}

export default {
	async fetch(request: Request, env: { MY_CONTAINER: DurableObjectNamespace<MyContainer> }): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		// If you want to route requests to a specific container,
		// pass a unique container identifier to .get()

		if (pathname.startsWith('/container')) {
			const id = env.MY_CONTAINER.idFromName(pathname);
			const container = env.MY_CONTAINER.get(id);
			return await container.fetch(request);
		}

		if (pathname.startsWith('/error')) {
			const id = env.MY_CONTAINER.idFromName('error-test');
			const container = env.MY_CONTAINER.get(id);
			return await container.fetch(request);
		}

		if (pathname.startsWith('/lb')) {
			const container = await loadBalance(env.MY_CONTAINER, 3);
			return await container.fetch(request);
		}

		if (pathname.startsWith('/singleton')) {
			// gets the default instance
			// useful for singleton containers, and eventually will
			// be used when autoscaling is implemented
			return await getContainer(env.MY_CONTAINER).fetch(request);
		}

		return new Response(
			'Call /container to start a container with a 10s timeout.\nCall /error to start a container that errors\nCall /lb to test load balancing',
		);
	},
};
