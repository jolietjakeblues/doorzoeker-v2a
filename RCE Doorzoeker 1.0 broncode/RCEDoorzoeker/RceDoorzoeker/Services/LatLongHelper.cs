using System;
using RceDoorzoeker.Services.Querying;

namespace RceDoorzoeker.Services
{
	static internal class LatLongHelper
	{
		public static double CalcLatLongPerPixel(int pixelHeight, LatLong topLeft, LatLong bottomRight)
		{
			double distance = Math.Abs(topLeft.Latitude - bottomRight.Latitude);
			return distance / (Double)pixelHeight;
		}
	}
}