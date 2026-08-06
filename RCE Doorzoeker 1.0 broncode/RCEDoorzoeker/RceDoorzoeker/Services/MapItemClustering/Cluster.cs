using System;
using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Services.MapItemClustering
{
	public class Cluster
	{
		private readonly double _latLongPerPixel;

		public Cluster(double latLongPerPixel)
		{
			_latLongPerPixel = latLongPerPixel;
		}

		public int Count;

		public LatLong Center;
		
		public double PointSizeLatLongSquared()
		{
			return Math.Pow(PointSizeLatLong(), 2.0);
		}

		public double PointSizeLatLong()
		{
			return PointSize() * _latLongPerPixel;
		}

		private double PointSize()
		{
			var scaled = (40 + (Count * 2));
			if (scaled > 100) return 100;
			return scaled;
		}
	}
}