using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Services.MapItemClustering
{
	public class MapPoint
	{
		public static int Size = 40;

		private readonly object _mapObject;

		public PointState State = PointState.Unhandled;

		public LatLong LatLong { get; set; }

		public object MapObject
		{
			get { return _mapObject; }
		}

		public MapPoint(LatLong latLong, object mapObject)
		{
			_mapObject = mapObject;
			LatLong = latLong;
		}

		public MapPoint(double longitude, double latitude, object mapObject)
		{
			_mapObject = mapObject;
			LatLong = new LatLong()
				{
					Latitude = latitude,
					Longitude = longitude
				};
		}

	}
}