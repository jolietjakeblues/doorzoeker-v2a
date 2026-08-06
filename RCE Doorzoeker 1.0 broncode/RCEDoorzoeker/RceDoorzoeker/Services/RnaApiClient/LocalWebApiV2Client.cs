using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Web;
using RceDoorzoeker.Services.RnaApiClient.DTO;
using Trezorix.RnaRemote;

namespace RceDoorzoeker.Services.RnaApiClient
{
	public class LocalWebApiV2Client
	{
		private readonly RnaApiConnector _connector;

		public LocalWebApiV2Client(RnaApiConnector connector)
		{
			_connector = connector;
		}

		public PagedList<ChildItem> GetChildrenPage(string uri, int start = 0, int count = 20)
		{
			var client = OpenApiClient();

			HttpResponseMessage response = client.GetAsync(string.Format("api2/item/children?uri={0}&start={1}&count={2}&api_key={3}", uri, start, count, _connector.ApiKey)).Result;
			
			if (!response.IsSuccessStatusCode)
			{
				throw new HttpException((int) HttpStatusCode.BadRequest, 
					string.Format("Error retrieving children for item {0} error: {1}", uri, response.ReasonPhrase));
			}

			var children = response.Content.ReadAsAsync<PagedList<ChildItem>>().Result;

			return children;
		}

		public int GetChildRowPosition(string uri)
		{
			var client = OpenApiClient();

			HttpResponseMessage response = client.GetAsync(string.Format("api2/item/GetChildRowPosition?uri={0}&api_key={1}", uri, _connector.ApiKey)).Result;

			if (!response.IsSuccessStatusCode)
			{
				throw new HttpException((int)HttpStatusCode.BadRequest,
					string.Format("Error retrieving child row position for item {0} error: {1}", uri, response.ReasonPhrase));
			}

			var position = response.Content.ReadAsAsync<int>().Result;

			return position;
		}

		private HttpClient OpenApiClient()
		{
			var client = new HttpClient();

			client.BaseAddress = new Uri(_connector.ApiBaseUrl);

			client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
			return client;
		}
	}
}