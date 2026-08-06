namespace RceDoorzoeker.Services.ConfigSwitcher
{
	public enum ValidationResultLevels
	{
		Error,
		Warning,
	}

	public class ValidationResult
	{
		public ValidationResult(ValidationResultLevels level, string message, string details = null)
		{
			Level = level;
			Message = message;
			Details = details;
		}

		public ValidationResultLevels Level { get; private set; }
		public string Message { get; private set; }
		public string Details { get; private set; }

		
	}
}
