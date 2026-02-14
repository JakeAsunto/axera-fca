const { HttpClient, ApiClient } = require('./http');

const test = async () => {
  try {
    const httpClient = new HttpClient().buildClient().getClient();
    console.log({ httpClient })

    // Test HTTP client
    const response = await httpClient.cleanGet('https://example.com');
    console.log(response);
  } catch (error) {
    console.error(error);
  }
};

test();