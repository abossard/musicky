import { useState } from 'react';
import { 
  Stack, 
  Title, 
  Text, 
  Group, 
  Paper, 
  Badge, 
  Button, 
  Alert,
  Code,
  Divider,
  Grid,
  Box
} from '@mantine/core';
import { FileBrowser, type FileItem } from '../../components/FileBrowser';

export default function FileBrowserDemo() {
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [mode, setMode] = useState<'single' | 'multiple'>('single');

  const handleFileSelect = (file: FileItem) => {
    setSelectedFile(file);
  };

  const handleMultipleFileSelect = (files: FileItem[]) => {
    setSelectedFiles(files);
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>File Browser Demo</Title>
        <Text c="dimmed" mt="sm">
          Browse your local file system for music files. Navigate through directories and select files to see details in the right panel.
        </Text>
      </div>

      {/* Mode Selection */}
      <Group>
        <Button 
          variant={mode === 'single' ? 'filled' : 'outline'}
          onClick={() => setMode('single')}
        >
          Single Selection
        </Button>
        <Button 
          variant={mode === 'multiple' ? 'filled' : 'outline'}
          onClick={() => setMode('multiple')}
        >
          Multiple Selection
        </Button>
      </Group>

      {/* Main Content with File Browser and Selection Panel */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper>
            <FileBrowser
              onFileSelect={mode === 'single' ? handleFileSelect : undefined}
              onMultipleFileSelect={mode === 'multiple' ? handleMultipleFileSelect : undefined}
              allowMultipleSelection={mode === 'multiple'}
              extensions={['mp3', 'wav', 'flac', 'aac', 'm4a']}
              height={600}
              showSearch={true}
              showFilters={true}
            />
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" withBorder h={600} style={{ position: 'sticky', top: 20 }}>
            <Stack gap="md" h="100%">
              <Title order={4}>Selection Details</Title>
              
              {mode === 'single' ? (
                selectedFile ? (
                  <Stack gap="sm">
                    <Group>
                      <Text fw={500}>Selected File:</Text>
                      <Badge variant="light">{selectedFile.extension}</Badge>
                    </Group>
                    <Text><strong>Name:</strong> {selectedFile.name}</Text>
                    <Text><strong>Path:</strong></Text>
                    <Code block>{selectedFile.path}</Code>
                    {selectedFile.size && (
                      <Text><strong>Size:</strong> {Math.round(selectedFile.size / 1024)} KB</Text>
                    )}
                    {selectedFile.lastModified && (
                      <Text><strong>Modified:</strong> {selectedFile.lastModified.toLocaleDateString()}</Text>
                    )}
                    
                    <Divider />
                    
                    <Button variant="light" size="sm" fullWidth>
                      Open File
                    </Button>
                    <Button variant="outline" size="sm" fullWidth>
                      Show in Finder
                    </Button>
                  </Stack>
                ) : (
                  <Alert color="blue" title="No file selected">
                    Click on a file in the browser to see its details here.
                  </Alert>
                )
              ) : (
                selectedFiles.length > 0 ? (
                  <Stack gap="sm" style={{ flex: 1 }}>
                    <Group>
                      <Text fw={500}>Selected Files:</Text>
                      <Badge variant="light">{selectedFiles.length} files</Badge>
                    </Group>
                    
                    <Box style={{ flex: 1, overflow: 'auto' }}>
                      <Stack gap="xs">
                        {selectedFiles.map((file, index) => (
                          <Paper key={file.path} p="xs" withBorder>
                            <Stack gap={4}>
                              <Text size="sm" fw={500}>{file.name}</Text>
                              <Group gap="xs">
                                <Badge size="xs" variant="outline">{file.extension}</Badge>
                                {file.size && (
                                  <Text size="xs" c="dimmed">
                                    {Math.round(file.size / 1024)} KB
                                  </Text>
                                )}
                              </Group>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                    
                    <Divider />
                    
                    <Text size="sm" c="dimmed">
                      Total: {selectedFiles.length} files, {Math.round(selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0) / 1024)} KB
                    </Text>
                    
                    <Group>
                      <Button variant="light" size="sm" style={{ flex: 1 }}>
                        Add to Playlist
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedFiles([])}>
                        Clear
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Alert color="blue" title="No files selected">
                    Use the checkboxes in the browser to select multiple files.
                  </Alert>
                )
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Usage Examples - moved to bottom */}
      <Stack gap="md">
        <Title order={3}>Usage Examples</Title>
        
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Text fw={500}>Basic Usage:</Text>
            <Code block>
{`import { FileBrowser } from '../components/FileBrowser';

function MyComponent() {
  const handleFileSelect = (file) => {
    console.log('Selected file:', file.path);
  };

  return (
    <FileBrowser
      onFileSelect={handleFileSelect}
      extensions={['mp3', 'wav']}
      height={400}
    />
  );
}`}
            </Code>
          </Stack>
        </Paper>

        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Text fw={500}>Multiple Selection:</Text>
            <Code block>
{`<FileBrowser
  allowMultipleSelection={true}
  onMultipleFileSelect={(files) => {
    console.log('Selected files:', files);
  }}
  extensions={['mp3', 'flac', 'wav']}
  showSearch={true}
  showFilters={true}
/>`}
            </Code>
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}
