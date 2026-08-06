using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using RceDoorzoeker.Configuration;

namespace RceDoorzoeker.Services.ConfigSwitcher
{
	public class ConfigSwitcher
	{
		private readonly string _cfgFilePathName;

		public ConfigSwitcher(string mainCfgFilePathName)
		{
			_cfgFilePathName = mainCfgFilePathName;
		}

		public List<ValidationResult> ValidateConfig(string configFile)
		{
			var validationResults = new List<ValidationResult>();

			DoorzoekerConfig config;
			try
			{
				config = DoorzoekerConfig.Load(configFile);
			}
			catch (InvalidOperationException ex)
			{
				
				validationResults.Add(new ValidationResult(
					level: ValidationResultLevels.Error, 
					message: "Fout opgetreden bij inladen configuratie bestand. Is de opmaak correct?", 
					details: ex.ToString()
					));
				return validationResults;
			}
			
			if (!config.Facets.Any(f => f.Enabled))
			{
				validationResults.Add(new ValidationResult(
					level: ValidationResultLevels.Error, 
					message: "De configuratie bevat geen facetten die enabled zijn."));
			}

			if (!config.ItemTypes.Any(f => f.Enabled))
			{
				validationResults.Add(new ValidationResult(
					level: ValidationResultLevels.Error,
					message: "De configuratie bevat geen item types die enabled zijn."));
			}

			if (!config.ReferenceStructures.Any(f => f.Enabled))
			{
				validationResults.Add(new ValidationResult(
					level: ValidationResultLevels.Error,
					message: "De configuratie bevat geen structuren die enabled zijn."));
			}

			return validationResults;
		}

		public int DetermineBackupNumber()
		{
			var cfgName = Path.GetFileNameWithoutExtension(_cfgFilePathName);

			var cfgDirectory = Path.GetDirectoryName(_cfgFilePathName);
			return DetermineBackupNumber(cfgDirectory, cfgName);	
		}

		public void RestoreBackup()
		{
			var cfgName = Path.GetFileNameWithoutExtension(_cfgFilePathName);

			var cfgDirectory = Path.GetDirectoryName(_cfgFilePathName);
			var bakNumber = DetermineBackupNumber(cfgDirectory, cfgName);

			var bakFileName = CreateBackupFileName(cfgName, bakNumber);

			File.Replace(Path.Combine(cfgDirectory, bakFileName), _cfgFilePathName, null);
		}

		public void EstablishNewConfig(string configFile)
		{
			var cfgName = Path.GetFileNameWithoutExtension(_cfgFilePathName);

			var cfgDirectory = Path.GetDirectoryName(_cfgFilePathName);
			var bakNumber = DetermineBackupNumber(cfgDirectory, cfgName) + 1;

			var bakFileName = CreateBackupFileName(cfgName, bakNumber); 
			File.Replace(configFile, _cfgFilePathName, Path.Combine(cfgDirectory, bakFileName));
		}

		private static string CreateBackupFileName(string cfgName, int bakNumber)
		{
			var bakFileName = string.Format("{0}.bak{1:00}.cfg", cfgName, bakNumber);
			return bakFileName;
		}

		private static int DetermineBackupNumber(string cfgDirectory, string cfgName)
		{
			var bakFiles = Directory.GetFiles(cfgDirectory, string.Format("{0}.bak*.cfg", cfgName));

			return DetermineBackupNumber(bakFiles, cfgName);
		}

		internal static int DetermineBackupNumber(string[] bakFiles, string cfgName)
		{
			if (bakFiles.Length > 0)
			{
				var regex = new Regex(string.Format("{0}.bak([0-9]*).cfg$", cfgName));
				return bakFiles.Max(b => Convert.ToInt32(regex.Match(b).Groups[1].Value));
			}
			return 0;
		}
	}
}
